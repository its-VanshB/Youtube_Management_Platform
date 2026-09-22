class ApiResponse{
    constructor(data , message = "success", statusCode){
        this.data = data;
        this.statusCode = statusCode,
        this.message = message,
        this.success = statusCode < 400
    }
}

export { ApiResponse };