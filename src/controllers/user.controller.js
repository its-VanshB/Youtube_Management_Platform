import { ApiError } from "../utils/api_error.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/api_response.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async (userId) => {
    try{
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave : false});

        return { accessToken , refreshToken };
    }catch (error) {
        throw new ApiError(500 , "something went wrong while generating access and refresh token");
    }
}

const registerUser = asyncHandler(
    async (req , res) => {
        //get user details from the frontend
        //validate the data
        //check if user already exist
        //check for images,avatar 
        //upload the images or avatar to the cloudinary
        //create user object and create entry in the db
        //remove password and the refresh tokens from the response
        //check for the user creation
        // return response

        const {fullname , email , username , password } = req.body;
        if(
            [fullname ,email , password , username].some((field) => field?.trim() == "")
        ) {
            throw new ApiError(400 , "All fields are required");
        }

        const existedUser = await User.findOne({
            $or: [{username} ,{email}]
        });

        if(existedUser){
            throw new ApiError(409 , "User with email or username already exist");
        }

        const avatarLocalPath = req.files?.avatar[0]?.path;
        //const coverimageLocalPath = req.files?.coverimage[0]?.path;

        let coverimageLocalPath;
        if(req.files && Array.isArray(req.files.coverimage) && req.files.coverimage.length>0){
            coverimageLocalPath = req.files.coverimage[0].path;
        }

        if(!avatarLocalPath) {
            throw new ApiError(400 , "Avatar file is required");
        }

        const avatar = await uploadOnCloudinary(avatarLocalPath);
        const coverimage = await uploadOnCloudinary(coverimageLocalPath);

        if(!avatar) {
            throw new ApiError(400 , "Avatar file is required");
        }

        const user =  await User.create({
            fullname,
            avatar : avatar.url,
            coverimage : coverimage?.url || "",
            email,
            password,
            username : username.toLowerCase()
        });

        const createdUser = await User.findById(user._id).select(
            "-password -refreshToken"
        )

        if(!createdUser) {
            throw new ApiError(500 , "something went wrong while registering the user");
        }

        return res.status(201).json(
            new ApiResponse(200 , createdUser , "User registered Successfully")
        )
    }
)

const loginUser = asyncHandler(
    async(req , res) => {
        //get the email , pass from the req body
        //validate if its not empty details by the user
        //check the user exist in db or not
        //if exist check the password
        //generate access token and refresh token
        //send cookies

        const {email , password , username} = req.body;

        if(!username && !email) {
            throw new ApiError(400 , "username or password is required");
        }

        const existedUser = await User.findOne({
            $or : [{username} , {email}]
        });

        if(!existedUser) {
            throw new ApiError(404 , "user does not exist");
        }

        const isPasswordValid = await existedUser.isPasswordCorrect(password);

        if(!isPasswordValid) {
            throw new ApiError(401 , "invalid user credentials");
        }

        const {accessToken , refreshToken} = await generateAccessAndRefreshToken(existedUser._id);

        const loggedInUser = await User.findById(existedUser._id).select(
            "-password -refreshToken"
        );

        const options = {
            httpOnly : true,
            Secure : true
        }

        return res
        .status(200)
        .cookie("accessToken" , accessToken , options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                user : loggedInUser, accessToken , refreshToken
                },
                "User logged in successfully"
            )
        )

    }
)

const logOutUser = asyncHandler(
    async(req , res) => {
        await User.findByIdAndUpdate(
            "req.user._id" , 
            {
                $set : {
                    refreshToken : undefined
                }
            },
            {
                new : true
            }
        );

        const options = {
            httpOnly : true,
            Secure : true
        }

        return res
        .status(200)
        .clearCookie("accessToken" , options)
        .clearCookie("refreshToken" , options)
        .json(
            new ApiResponse(
                200,
                {},
                "log out successfully"
            )
        )
    }
)

const refreshAccessToken = asyncHandler(
    async(req , res) => {
        const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

        if(!incomingRefreshToken) {
            throw new ApiError(401, "unauthorized request");
        }

        try {
            const decodedToken = jwt.verify(incomingRefreshToken , process.env.REFRESH_TOKEN_SECRET);
    
            const user = User.findById(decodedToken?._id);
    
            if(!user) {
                throw new ApiError(401 , "invalid refresh token");
            }
    
            if(incomingRefreshToken !== user?.refreshToken){
                throw new ApiError(401 , "Refresh token is expired or used");
            }
    
            const options = {
                httpOnly : true,
                secure : true
            }
    
            const {accessToken , newRefreshToken} = await generateAccessAndRefreshToken(user._id);
    
            return res
            .status(200)
            .cookie("accessToken" , accessToken , options)
            .cookie("refreshToken" , newRefreshToken , options)
            .json(
                new ApiResponse(
                    200,
                    {accessToken , newRefreshToken},
                    "new access token refreshed"
                )
            )
        } catch (error) {
            throw new ApiError(401, error?.message || "invalid refresh token");
        }
    }
)

const changeCurrentUserPassword = asyncHandler(
    async(req , res) => {
        const {oldPassword , newPassword} = req.body;

        if(oldPassword === newPassword) {
            throw new ApiError(
                400,
                "new password and old password should be different"
            )
        }

        const user = await User.findById(user?._id);

        const isPasswordCorrect = await user.isPasswordCorrect(user.oldPassword);

        if(!isPasswordCorrect){
            throw new ApiError(
                404,
                "old password is incorrect"
            )
        }

        user.password = newPassword;
        await user.save({validateBeforeSave : false});

        return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {},
                "Password change Successfully"
            )
        );
    }
);

const getCurrentUser = asyncHandler(
    async(req , res) => {
        return res
        .status(200)
        .json(
            new ApiResponse(200 , req.user , "current user fetched successfully")
        )
    }
);

const updateAccountDetails = asyncHandler(
    async(req , res) => {
        const {fullname , email} = req.body;

        if(!(fullname || email)){
            throw new ApiError(200 , "ALl fields are required");
        }

        const user = await User.findByIdAndUpdate(
            req.user?._id,
            {
                $set : {
                    fullname,
                    email
                }
            },
            {
                new : true
            }
        ).select("-password -refreshToken");

        return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                user,
                "account details updated successfully"
            )
        )
    }
);

const updateUserAvatar = asyncHandler(
    async(req , res) =>{
        const avatarLocalPath = req.file?.path;
        
        if(!avatarLocalPath){
            throw new ApiError(
                400,
                "avatar file is missing"
            )
        }

        const avatar = await uploadOnCloudinary(avatarLocalPath);

        if(!avatar.url){
            throw new ApiError(
                500,
                "error while uploading on avatar"
            )
        }

        const user = await User.findByIdAndUpdate(
            req.user?._id,
            {
                $set : {
                    avatar : avatar.url
                }
            },
            {
                new : true
            }
        ).select("-password");

        res
        .status(200)
        .json(
            ApiResponse(
                200,
                user,
                "The avatar has been updated"
            )
        );
    }
);

const updateUserCoverImage = asyncHandler(
    async(req , res) => {
        const coverimageLocalPath = req.file?.path;

        if(!coverimageLocalPath){
            throw new ApiError(
                400,
                "cover image is missing"
            )
        }

        const coverImage = await uploadOnCloudinary(coverimageLocalPath);

        if(!coverImage.url){
            throw new ApiError(
                500,
                "error while uploading the cover image"
            )
        }

        const user = await findByIdAndUpdate(
            req.user?._id,
            {
                $set : {
                    coverImage
                }
            },
            {
                new : true
            }
        ).select("-password");

        res
        .status(200)
        .json(
            new ApiResponse(
                200,
                user,
                "Cover Image has been updated"
            )
        )
    }
);

export {
    registerUser,
    loginUser,
    logOutUser,
    refreshAccessToken,
    changeCurrentUserPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage
};