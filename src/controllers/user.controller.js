import { ApiError } from "../utils/api_error.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/api_response.js";

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

export { registerUser };