import axios from "axios";
var renderServer = 'https://coffeserver.onrender.com'
var localHost = 'http://localhost:4000'
export const autenticateUserRequest = async (userName, pass) =>
    await axios.get(`${renderServer}/users/${userName}/${pass}`);
