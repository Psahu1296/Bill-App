import { Router, Request, Response, NextFunction } from "express";

const router = Router();

const GITHUB_RELEASES_URL = "https://api.github.com/repos/Psahu1296/Bill-App/releases";

/**
 * GET /api/updates/releases
 *
 * Proxies the GitHub Releases API so the frontend never needs a token.
 * If GH_TOKEN is set in the environment it is forwarded as a Bearer token,
 * which is required for private repositories.
 */
router.get("/releases", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const headers: Record<string, string> = {
      "Accept":     "application/vnd.github+json",
      "User-Agent": "Dhaba-POS-App",
    };

    const token = process.env["GH_TOKEN"];
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const ghRes = await fetch(GITHUB_RELEASES_URL, { headers });

    if (!ghRes.ok) {
      const text = await ghRes.text().catch(() => "");
      return res.status(ghRes.status).json({
        success: false,
        message: `GitHub API error ${ghRes.status}`,
        detail:  text,
      });
    }

    const data = await ghRes.json();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;
