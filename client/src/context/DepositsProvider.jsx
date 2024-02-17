import { createContext, useContext, useState } from "react";
import {
    getDepositsRequest,
    getDepositByOrderIdRequest,
    createDepositRequest
} from "../api/deposits.api";
import { DepositContext } from "./DepositsContext.jsx";

export const useDeposits = () => {
    const context = useContext(DepositContext);
    if (context === undefined) {
        throw new Error("useDeposits must be used within a DepositContextProvider");
    }
    return context;
};


export const DepositContextProvider = ({ children }) => {
    const [deposits, setDeposits] = useState([]);

    async function loadDeposits() {
        const response = await getDepositsRequest();
        setDeposits(response.data);
    }

    const createDeposit = async (deposits) => {
        try {
            await createDepositRequest(deposits);
            // setDeposits([...Deposits, response.data]);
        } catch (error) {
            console.error(error);
        }
    };

    const getDepositsByOrderId = async (id) => {
        try {
            const response = await getDepositByOrderIdRequest(id);
            return response.data;
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <DepositContext.Provider
            value={{
                deposits,
                loadDeposits,
                createDeposit,
                getDepositsByOrderId
            }}
        >
            {children}
        </DepositContext.Provider>
    );
};
