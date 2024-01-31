import { createContext, useContext, useState } from "react";
import {
  autenticateUserRequest,
} from "../api/users.api";
import { UserContext } from "./UserContext";

export const useUsers = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUsers must be used within a UserContextProvider");
  }
  return context;
};


export const UserContextProvider = ({ children }) => {

  const [user, setUser] = useState([]);

  const autenticateUser = async (userName, pass) => {
    try {
      const response = await autenticateUserRequest(userName, pass);
      return response.data;
      setUser(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <UserContext.Provider
      value={{
        user,
        autenticateUser,
        //logOut
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
