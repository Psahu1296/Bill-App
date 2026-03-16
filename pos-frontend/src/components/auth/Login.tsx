import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { login } from "../../https/index";
import { enqueueSnackbar } from "notistack";
import { useNavigate } from "react-router-dom";
import { setUser } from "../../redux/slices/userSlice";
import { useAppDispatch } from "../../redux/hooks";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [formData, setFormData] = useState({ email: "", password: "" });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(formData);
  };

  const loginMutation = useMutation({
    mutationFn: (reqData: { email: string; password: string }) => login(reqData),
    onSuccess: (res) => {
      const { data } = res;
      const { _id, name, email, phone, role } = data.data as {
        _id: string; name: string; email: string; phone: string; role: string;
      };
      dispatch(setUser({ _id, name, email, phone, role }));
      navigate("/");
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      const message = error.response?.data?.message || "Login failed. Please try again.";
      enqueueSnackbar(message, { variant: "error" });
    },
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-dhaba-muted mb-2 text-xs font-bold tracking-wider uppercase">
          Email
        </label>
        <div className="glass-input rounded-xl px-4 py-3">
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Enter your email"
            className="bg-transparent flex-1 w-full text-dhaba-text text-sm focus:outline-none placeholder:text-dhaba-muted/50"
            required
          />
        </div>
      </div>
      <div>
        <label className="block text-dhaba-muted mb-2 text-xs font-bold tracking-wider uppercase">
          Password
        </label>
        <div className="glass-input rounded-xl px-4 py-3">
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Enter password"
            className="bg-transparent flex-1 w-full text-dhaba-text text-sm focus:outline-none placeholder:text-dhaba-muted/50"
            required
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={loginMutation.isPending}
        className="w-full btn-accent rounded-xl py-3.5 text-base mt-2"
      >
        {loginMutation.isPending ? "Signing in..." : "Sign In"}
      </button>
    </form>
  );
};

export default Login;
