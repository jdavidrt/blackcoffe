import axios from `axios`;
var renderServer = 'https://coffeserver.onrender.com'
export const autenticateUserRequest = async (userName, pass) =>
    await axios.get(`${renderServer}/users/${userName}/${pass}`);
