import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUserData } from "../https";
import { removeUser, setUser } from "../redux/slices/userSlice";
import { useAppDispatch } from "../redux/hooks";

const useLoadData = (): boolean => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data } = await getUserData();
        const { _id, name, email, phone, role } = data.data as {
          _id: string;
          name: string;
          email: string;
          phone: string;
          role: string;
        };
        dispatch(setUser({ _id, name, email, phone, role }));
      } catch {
        dispatch(removeUser());
        navigate("/auth");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [dispatch, navigate]);

  return isLoading;
};

export default useLoadData;
