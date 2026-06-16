import { createContext, useContext, useEffect, useState } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("synkdata_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(false);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("synkdata_token", data.token);
    localStorage.setItem("synkdata_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    localStorage.setItem("synkdata_token", data.token);
    localStorage.setItem("synkdata_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("synkdata_token");
    localStorage.removeItem("synkdata_user");
    setUser(null);
  };

  useEffect(() => {
    const token = localStorage.getItem("synkdata_token");
    if (token && !user) {
      setLoading(true);
      api.get("/auth/me").then(({ data }) => {
        setUser(data);
        localStorage.setItem("synkdata_user", JSON.stringify(data));
      }).catch(() => {
        localStorage.removeItem("synkdata_token");
        localStorage.removeItem("synkdata_user");
      }).finally(() => setLoading(false));
    }
  }, []); // eslint-disable-line

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
