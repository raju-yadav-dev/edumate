import "./App.css";

import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home/Home";
import Login from "./pages/Login/Login";
import Register from "./pages/Register/Register";
import ForgotPassword from "./pages/ForgotPassword/ForgotPassword";
import Profile from "./pages/Profile/Profile";
import Chat from "./pages/Chat/Chat";
import AdminLogin from "./Admin/Login/AdminLogin";
import AdminConsole from "./Admin/Console/AdminConsole";

function App() {

    return (

        <BrowserRouter>

            <Routes>

                <Route
                    path="/"
                    element={<Home />}
                />

                <Route
                    path="/chat"
                    element={<Chat />}
                />

                <Route
                    path="/login"
                    element={<Login />}
                />

                <Route
                    path="/register"
                    element={<Register />}
                />
                <Route
                    path="/forgot-password"
                    element={<ForgotPassword />}
                />

                <Route
                    path="/profile"
                    element={<Profile />}
                />

                <Route
                    path="/admin"
                    element={<AdminLogin />}
                />

                <Route
                    path="/admin/panel"
                    element={<AdminConsole />}
                />

            </Routes>

        </BrowserRouter>

    );

}

export default App;
