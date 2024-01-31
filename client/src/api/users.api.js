import axios from "axios";

export const autenticateUserRequest = async (userName, pass) =>
    await axios.get(`http://localhost:4000/users/${userName}/${pass}`);
