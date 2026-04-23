import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUserData } from "../https";
import { removeUser, setUser } from "../redux/slices/userSlice";
import { useAppDispatch } from "../redux/hooks";

const useLoadData = (): boolean => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  const [isLoading, setIsLoading] = useState(true);

  // Keep navigateRef current without adding navigate to the effect deps.
  // BrowserRouter's useNavigate is "unstable" — it returns a new function on
  // every location change, so listing it in the effect deps causes fetchUser
  // to re-run after every navigation, which undoes login/logout.
  useEffect(() => {
    navigateRef.current = navigate;
  });

  useEffect(() => {
    let cancelled = false;

    const fetchUser = async () => {
      try {
        const { data } = await getUserData();
        if (cancelled) return;
        const { _id, name, email, phone, role } = data.data as {
          _id: string;
          name: string;
          email: string;
          phone: string;
          role: string;
        };
        dispatch(setUser({ _id, name, email, phone, role }));
      } catch {
        if (cancelled) return;
        dispatch(removeUser());
        navigateRef.current("/auth");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchUser();

    // Cleanup cancels any in-flight fetch (guards against React StrictMode
    // double-fire and against stale async results after unmount).
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  return isLoading;
};

export default useLoadData;
