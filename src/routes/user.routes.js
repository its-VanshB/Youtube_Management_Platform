import { Router } from "express";
import { loginUser, logOutUser, registerUser , refreshAccessToken} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/authentication.middleware.js";

const router = Router();

router.route("/register").post(
    upload.fields([
        {
            name : "avatar",
            maxCount : 1
        },
        {
            name : "coverimage",
            maxCount : 1
        }
    ]),
    registerUser
);

router.route("/login").post( verifyJWT , loginUser);

//secured routes
router.route("/logout").post( verifyJWT , logOutUser);
router.route("/refresh-token").post(refreshAccessToken);

export default router;