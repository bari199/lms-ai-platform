import { Router } from "express";
import { register, login, getMe, refresh, logout } from "./auth.controller.js";
import { authenticateToken } from "../../middleware/auth.middleware.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", authenticateToken, getMe);
router.post("/refresh", refresh);
router.post("/logout", logout);

export default router;
