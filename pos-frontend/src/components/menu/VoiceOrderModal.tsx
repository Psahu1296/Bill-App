import React, { useState, useRef, useCallback, useEffect } from "react";
import { FaMicrophone, FaStop, FaTimes, FaCheck, FaRedo, FaShoppingCart } from "react-icons/fa";
import { voiceParseDishes } from "../../https";
import type { Dish, DishVariant } from "../../types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ResolvedItem  { dish: Dish; variant: DishVariant; quantity: number; }
interface AmbiguousItem { query: string; quantity: number; candidates: Dish[]; }
interface VoiceParseResult {
  resolved: ResolvedItem[];
  ambiguous: AmbiguousItem[];
  unmatched: string[];
}

interface ConfirmedItem {
  key: string;        // `${dish._id}_${variant.size}`
  dish: Dish;
  variant: DishVariant;
  quantity: number;
}

type Phase = "idle" | "recording" | "loading" | "review";

interface Props {
  onAddToCart: (dish: Dish, variant: DishVariant, qty: number) => void;
  onClose: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MIN_DURATION_S     = 2;     // skip API if recording < 2 seconds
const MAX_DURATION_S     = 45;    // auto-stop at 45 seconds
const WARN_AT_S          = 40;    // show countdown warning from this point
const MIN_BLOB_KB        = 5;     // skip API if blob < 5 KB (silence / no mic)
const MAX_BLOB_MB        = 3;     // skip API if blob > 3 MB (abnormal)
const SILENCE_THRESHOLD  = 0.008; // minimum RMS floor (quiet rooms)
const NOISE_MULTIPLIER   = 1.5;   // dynamic threshold = ambient_rms × this
const MAX_THRESHOLD      = 0.05;  // cap so busy rooms don't block normal speech
const CALIB_SAMPLES      = 15;    // intervals to sample ambient noise (1.5s)
const SILENCE_WARN_MS    = 5_000; // show "still listening" hint after 5s silence
const SILENCE_STOP_MS    = 10_000; // auto-stop after 10s continuous silence

// ── Helpers ───────────────────────────────────────────────────────────────────

const defaultVariant = (dish: Dish): DishVariant =>
  dish.variants.find((v) => v.size === "Full") ??
  dish.variants.find((v) => v.size === "Regular") ??
  dish.variants[0];

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const toKey = (dish: Dish, variant: DishVariant) => `${dish._id}_${variant.size}`;

// ── Component ─────────────────────────────────────────────────────────────────

const VoiceOrderModal: React.FC<Props> = ({ onAddToCart, onClose }) => {
  const [phase, setPhase]               = useState<Phase>("idle");
  const [seconds, setSeconds]           = useState(0);
  const [silenceMs, setSilenceMs]       = useState(0); // current continuous silence streak in ms
  const [isSpeaking, setIsSpeaking]     = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [confirmed, setConfirmed]       = useState<ConfirmedItem[]>([]);
  const [ambiguous, setAmbiguous]       = useState<AmbiguousItem[]>([]);
  const [unmatched, setUnmatched]       = useState<string[]>([]);

  const mediaRecorderRef  = useRef<MediaRecorder | null>(null);
  const chunksRef         = useRef<Blob[]>([]);
  const streamRef         = useRef<MediaStream | null>(null);
  const timerRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef       = useRef<AudioContext | null>(null);
  const durationRef       = useRef(0);
  const silenceMsRef      = useRef(0); // mirrors silenceMs state — readable inside intervals
  const hasSpeechRef      = useRef(false); // true once 300ms of sustained sound above dynamic threshold
  const speechMsRef       = useRef(0);    // consecutive ms above threshold (noise guard)
  const noiseFloorRef     = useRef(SILENCE_THRESHOLD); // calibrated ambient RMS threshold
  const calibSamplesRef   = useRef<number[]>([]);
  const calibDoneRef      = useRef(false);
  const cancelledRef      = useRef(false);

  const stopTimer = () => {
    if (timerRef.current)   { clearInterval(timerRef.current);   timerRef.current   = null; }
    if (silenceRef.current) { clearInterval(silenceRef.current); silenceRef.current = null; }
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
  };

  const cleanup = useCallback(() => {
    stopTimer();
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  // ── Recording ───────────────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    setError(null);
    setConfirmed([]);
    setAmbiguous([]);
    setUnmatched([]);
    setSeconds(0);
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access denied. Allow mic in browser / OS settings.");
      return;
    }

    streamRef.current = stream;

    const mimeType =
      ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find((m) =>
        MediaRecorder.isTypeSupported(m)
      ) ?? "";

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stopTimer();
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;

      if (cancelledRef.current) {
        cancelledRef.current = false;
        setPhase("idle");
        return;
      }

      const duration = durationRef.current;
      const blob     = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
      chunksRef.current = [];

      if (!hasSpeechRef.current) {
        setPhase("idle");
        return;
      }

      if (duration < MIN_DURATION_S) {
        setPhase("idle");
        setError(`Too short — record for at least ${MIN_DURATION_S} seconds.`);
        return;
      }

      const blobKB = blob.size / 1024;
      if (blobKB < MIN_BLOB_KB) {
        setPhase("idle");
        setError("No audio captured — check your microphone.");
        return;
      }

      if (blob.size > MAX_BLOB_MB * 1024 * 1024) {
        setPhase("idle");
        setError(`Recording too large (${(blob.size / 1024 / 1024).toFixed(1)} MB). Try a shorter order.`);
        return;
      }

      setPhase("loading");
      try {
        const res = await voiceParseDishes(blob);
        const data: VoiceParseResult = res.data.data;

        setConfirmed(
          data.resolved.map((r) => ({
            key: toKey(r.dish, r.variant),
            dish: r.dish,
            variant: r.variant,
            quantity: r.quantity,
          }))
        );
        setAmbiguous(data.ambiguous);
        setUnmatched(data.unmatched);
        setPhase("review");
      } catch (err: unknown) {
        setPhase("idle");
        const msg: string =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "";
        if (!msg.toLowerCase().includes("no speech") && !msg.toLowerCase().includes("transcript is empty")) {
          setError("Failed to process voice order. Try again.");
        }
        // "no speech" from backend → silent reset to idle, no error shown
      }
    };

    recorder.start(250);
    cancelledRef.current    = false;
    durationRef.current     = 0;
    silenceMsRef.current    = 0;
    speechMsRef.current     = 0;
    hasSpeechRef.current    = false;
    noiseFloorRef.current   = SILENCE_THRESHOLD;
    calibSamplesRef.current = [];
    calibDoneRef.current    = false;
    setSilenceMs(0);
    setIsSpeaking(false);
    setPhase("recording");

    // ── Silence detection via Web Audio API ──────────────────────────────────
    try {
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Float32Array(analyser.fftSize);

      silenceRef.current = setInterval(() => {
        analyser.getFloatTimeDomainData(buf);
        const rms = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length);

        // Calibration phase: collect ambient RMS for first 1.5s, then set dynamic threshold
        if (!calibDoneRef.current) {
          calibSamplesRef.current.push(rms);
          if (calibSamplesRef.current.length >= CALIB_SAMPLES) {
            const avg = calibSamplesRef.current.reduce((a, b) => a + b, 0) / CALIB_SAMPLES;
            noiseFloorRef.current = Math.min(
              Math.max(avg * NOISE_MULTIPLIER, SILENCE_THRESHOLD),
              MAX_THRESHOLD,
            );
            calibDoneRef.current = true;
          }
          return; // don't run silence/speech detection during calibration
        }

        const threshold = noiseFloorRef.current;
        const speaking = rms >= threshold;
        setIsSpeaking(speaking);

        if (!speaking) {
          speechMsRef.current = 0;
          silenceMsRef.current += 100;
          setSilenceMs(silenceMsRef.current);
          if (silenceMsRef.current >= SILENCE_STOP_MS) {
            mediaRecorderRef.current?.stop();
          }
        } else {
          speechMsRef.current += 100;
          if (speechMsRef.current >= 300) hasSpeechRef.current = true;
          silenceMsRef.current = 0;
          setSilenceMs(0);
        }
      }, 100);
    } catch {
      // AudioContext unavailable — skip silence detection, other guards still apply
    }

    // ── Duration timer ────────────────────────────────────────────────────────
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        const next = s + 1;
        durationRef.current = next;
        if (next >= MAX_DURATION_S) {
          mediaRecorderRef.current?.stop();
        }
        return next;
      });
    }, 1000);
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  const cancelRecording = useCallback(() => {
    cancelledRef.current = true;
    mediaRecorderRef.current?.stop();
  }, []);

  // ── Review actions ──────────────────────────────────────────────────────────

  const changeQty = (key: string, delta: number) => {
    setConfirmed((prev) =>
      prev
        .map((i) => i.key === key ? { ...i, quantity: i.quantity + delta } : i)
        .filter((i) => i.quantity > 0)
    );
  };

  const changeVariant = (oldKey: string, dish: Dish, newVariant: DishVariant) => {
    const newKey = toKey(dish, newVariant);
    if (newKey === oldKey) return;
    setConfirmed((prev) => {
      const current = prev.find((i) => i.key === oldKey);
      if (!current) return prev;
      const collision = prev.find((i) => i.key === newKey);
      if (collision) {
        // merge into existing item, drop old
        return prev
          .map((i) => i.key === newKey ? { ...i, quantity: i.quantity + current.quantity } : i)
          .filter((i) => i.key !== oldKey);
      }
      return prev.map((i) =>
        i.key === oldKey ? { ...i, key: newKey, variant: newVariant } : i
      );
    });
  };

  const pickCandidate = (amb: AmbiguousItem, dish: Dish) => {
    const variant = defaultVariant(dish);
    const key = toKey(dish, variant);
    setConfirmed((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        return prev.map((i) => i.key === key ? { ...i, quantity: i.quantity + amb.quantity } : i);
      }
      return [...prev, { key, dish, variant, quantity: amb.quantity }];
    });
    setAmbiguous((prev) => prev.filter((a) => a.query !== amb.query));
  };

  const dismissUnmatched = (phrase: string) =>
    setUnmatched((prev) => prev.filter((u) => u !== phrase));

  const handleConfirm = () => {
    for (const item of confirmed) {
      onAddToCart(item.dish, item.variant, item.quantity);
    }
    onClose();
  };

  const handleRerecord = () => {
    setPhase("idle");
    setError(null);
    setConfirmed([]);
    setAmbiguous([]);
    setUnmatched([]);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const totalItems = confirmed.reduce((s, i) => s + i.quantity, 0);
  const canConfirm = confirmed.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-dhaba-bg/80 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-md rounded-3xl overflow-hidden flex flex-col shadow-2xl border border-white/10">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dhaba-border/20">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-dhaba-accent/10 flex items-center justify-center">
              <FaMicrophone className="text-dhaba-accent text-sm" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-dhaba-text">Voice Order</h2>
              <p className="text-[11px] text-dhaba-muted">Speak dish names, variants, quantities</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-dhaba-danger/10 text-dhaba-muted hover:text-dhaba-danger transition-colors"
          >
            <FaTimes />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Idle / Recording / Loading ── */}
          {(phase === "idle" || phase === "recording" || phase === "loading") && (
            <div className="flex flex-col items-center justify-center gap-6 px-6 py-10">

              {/* Mic ring */}
              <div className="relative flex flex-col items-center gap-3">
                <div className={`relative flex items-center justify-center ${phase === "recording" ? "animate-pulse" : ""}`}>
                  <div className={`h-24 w-24 rounded-full flex items-center justify-center transition-all duration-300 ${
                    phase === "recording"
                      ? isSpeaking
                        ? "bg-green-500/20 shadow-[0_0_40px_rgba(34,197,94,0.5)]"
                        : "bg-red-500/20 shadow-[0_0_40px_rgba(239,68,68,0.4)]"
                      : "bg-dhaba-accent/10"
                  }`}>
                    {phase === "loading" ? (
                      <span className="h-8 w-8 rounded-full border-[3px] border-dhaba-accent border-t-transparent animate-spin" />
                    ) : (
                      <FaMicrophone className={`text-3xl transition-colors duration-200 ${
                        phase === "recording"
                          ? isSpeaking ? "text-green-400" : "text-red-400"
                          : "text-dhaba-accent"
                      }`} />
                    )}
                  </div>
                  {phase === "recording" && (
                    <div className={`absolute inset-0 rounded-full border-2 animate-ping ${
                      isSpeaking ? "border-green-400/40" : "border-red-400/40"
                    }`} />
                  )}
                </div>

                {/* Voice activity badge */}
                {phase === "recording" && (
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold transition-all duration-200 ${
                    isSpeaking
                      ? "bg-green-500/15 text-green-400"
                      : "bg-red-500/15 text-red-400"
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${isSpeaking ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
                    {isSpeaking ? "Voice captured" : "No speech"}
                  </div>
                )}
              </div>

              {/* Timer / status text */}
              <div className="text-center space-y-1">
                {phase === "recording" && (
                  <p className={`font-display text-2xl font-bold tabular-nums ${seconds >= WARN_AT_S ? "text-orange-400" : "text-red-400"}`}>
                    {fmt(seconds)}
                    {seconds >= WARN_AT_S && (
                      <span className="text-sm font-normal ml-2">/ {fmt(MAX_DURATION_S)}</span>
                    )}
                  </p>
                )}
                <p className="text-sm font-semibold text-dhaba-text">
                  {phase === "idle"      && "Tap mic to start"}
                  {phase === "recording" && (
                    seconds >= WARN_AT_S
                      ? "Wrapping up soon..."
                      : silenceMs >= SILENCE_WARN_MS
                      ? "Still listening..."
                      : "Listening..."
                  )}
                  {phase === "loading"   && "Processing audio..."}
                </p>
                {phase === "idle" && (
                  <p className="text-[11px] text-dhaba-muted leading-relaxed max-w-xs">
                    Say dish names, variants and quantities —<br />
                    e.g. <span className="text-dhaba-accent">"2 dal fry full, 1 chicken curry, 3 roti"</span>
                  </p>
                )}
                {phase === "recording" && (
                  <>
                    <p className={`text-[11px] transition-colors duration-300 ${
                      seconds >= WARN_AT_S
                        ? "text-orange-400/80"
                        : silenceMs >= SILENCE_STOP_MS - 2_000
                        ? "text-red-400/80"
                        : silenceMs >= SILENCE_WARN_MS
                        ? "text-orange-300/70"
                        : "text-dhaba-muted"
                    }`}>
                      {seconds >= WARN_AT_S
                        ? `Auto-stops at ${MAX_DURATION_S}s — finish speaking`
                        : silenceMs >= SILENCE_STOP_MS - 2_000
                        ? `Stopping in ${Math.ceil((SILENCE_STOP_MS - silenceMs) / 1000)}s — no speech detected`
                        : silenceMs >= SILENCE_WARN_MS
                        ? "No speech detected — say your items or tap Stop"
                        : "Speak all items, then tap Stop"}
                    </p>
                    {silenceMs >= SILENCE_WARN_MS && silenceMs < SILENCE_STOP_MS && seconds < WARN_AT_S && (
                      <div className="mt-1.5 h-0.5 w-32 rounded-full bg-dhaba-border/30 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-100 ${
                            silenceMs >= SILENCE_STOP_MS - 2_000 ? "bg-red-400/70" : "bg-orange-400/60"
                          }`}
                          style={{ width: `${Math.min((silenceMs / SILENCE_STOP_MS) * 100, 100)}%` }}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Error */}
              {error && (
                <p className="text-red-400 text-xs text-center max-w-xs">{error}</p>
              )}

              {/* Action buttons */}
              {phase !== "loading" && (
                <div className="flex items-center gap-3">
                  {phase === "recording" && (
                    <button
                      onClick={cancelRecording}
                      className="flex items-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm transition-all glass-input text-dhaba-muted hover:text-dhaba-danger hover:border-dhaba-danger/30"
                    >
                      <FaTimes size={12} /> Cancel
                    </button>
                  )}
                  <button
                    onClick={phase === "recording" ? stopRecording : startRecording}
                    className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all ${
                      phase === "recording"
                        ? "bg-red-500 text-white hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.4)]"
                        : "bg-gradient-warm text-dhaba-bg hover:shadow-glow"
                    }`}
                  >
                    {phase === "recording" ? <><FaStop size={12} /> Stop</> : <><FaMicrophone size={12} /> Start Recording</>}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Review phase ── */}
          {phase === "review" && (
            <div className="px-6 py-5 space-y-5">

              {/* Resolved items */}
              {confirmed.length > 0 && (
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-dhaba-muted mb-3 flex items-center gap-1.5">
                    <FaCheck className="text-green-400" />
                    Recognised ({confirmed.length})
                  </p>
                  <div className="space-y-2">
                    {confirmed.map((item) => (
                      <div
                        key={item.key}
                        className="glass-input rounded-xl px-4 py-2.5 space-y-2"
                      >
                        {/* Name + qty + price */}
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-dhaba-text truncate flex-1 min-w-0">
                            {item.dish.name}
                          </p>
                          <div className="flex items-center gap-2 ml-3 shrink-0">
                            <div className="flex items-center glass-card rounded-lg overflow-hidden">
                              <button
                                onClick={() => changeQty(item.key, -1)}
                                className="px-2.5 py-1.5 text-dhaba-accent font-bold text-sm hover:bg-dhaba-surface transition-colors"
                              >
                                −
                              </button>
                              <span className="px-2.5 text-sm font-bold text-dhaba-text min-w-[28px] text-center tabular-nums">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => changeQty(item.key, 1)}
                                className="px-2.5 py-1.5 text-dhaba-accent font-bold text-sm hover:bg-dhaba-surface transition-colors"
                              >
                                +
                              </button>
                            </div>
                            <span className="text-sm font-bold text-dhaba-text w-14 text-right tabular-nums">
                              ₹{item.variant.price * item.quantity}
                            </span>
                          </div>
                        </div>

                        {/* Variant pills */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {item.dish.variants.map((v) => (
                            <button
                              key={v.size}
                              onClick={() => changeVariant(item.key, item.dish, v)}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                                item.variant.size === v.size
                                  ? "bg-dhaba-accent text-dhaba-bg"
                                  : "glass-card text-dhaba-muted hover:text-dhaba-text"
                              }`}
                            >
                              {v.size}
                            </button>
                          ))}
                          <span className="text-[10px] text-dhaba-muted ml-0.5">
                            ₹{item.variant.price} each
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Ambiguous items */}
              {ambiguous.length > 0 && (
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-orange-400/80 mb-3">
                    Needs clarification ({ambiguous.length})
                  </p>
                  <div className="space-y-3">
                    {ambiguous.map((item) => (
                      <div key={item.query} className="glass-input rounded-xl px-4 py-3 border border-orange-500/20 space-y-2">
                        <p className="text-xs text-dhaba-text">
                          <span className="text-orange-400 font-semibold">"{item.query}"</span>
                          <span className="text-dhaba-muted"> × {item.quantity} — pick one:</span>
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {item.candidates.map((dish) => (
                            <button
                              key={dish._id}
                              onClick={() => pickCandidate(item, dish)}
                              className="px-3 py-1 rounded-lg text-[11px] font-bold bg-dhaba-accent/15 text-dhaba-accent hover:bg-dhaba-accent/30 transition-colors"
                            >
                              {dish.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Unmatched */}
              {unmatched.length > 0 && (
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-red-400/70 mb-3">
                    Not found ({unmatched.length})
                  </p>
                  <div className="space-y-1.5">
                    {unmatched.map((phrase) => (
                      <div
                        key={phrase}
                        className="flex items-center justify-between glass-input rounded-xl px-4 py-2 border border-red-500/15"
                      >
                        <p className="text-xs text-dhaba-muted">"{phrase}"</p>
                        <button
                          onClick={() => dismissUnmatched(phrase)}
                          className="text-dhaba-muted hover:text-dhaba-danger transition-colors ml-2"
                        >
                          <FaTimes size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {confirmed.length === 0 && ambiguous.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-dhaba-muted text-sm">Nothing was recognised. Try recording again.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {phase === "review" && (
          <div className="px-6 py-4 border-t border-dhaba-border/20 flex gap-3">
            <button
              onClick={handleRerecord}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl glass-input text-dhaba-muted hover:text-dhaba-text text-sm font-bold transition-all"
            >
              <FaRedo size={11} />
              Re-record
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-warm text-dhaba-bg font-bold text-sm hover:shadow-glow transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FaShoppingCart size={12} />
              Add {totalItems > 0 ? `${totalItems} item${totalItems !== 1 ? "s" : ""}` : "items"} to Cart
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceOrderModal;
