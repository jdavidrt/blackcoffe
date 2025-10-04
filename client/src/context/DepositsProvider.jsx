import { createContext, useContext, useState } from "react";
import {
    getDepositsRequest,
    getDepositByOrderIdRequest,
    createDepositRequest,
    deleteDepositById as deleteDepositByIdRequest,
    getDepositsByDateRequest
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
            console.log('[DepositsProvider] Creating deposit:', deposits);
            const response = await createDepositRequest(deposits);
            console.log('[DepositsProvider] Deposit created successfully:', response.data);
            return response.data;
        } catch (error) {
            console.error('[DepositsProvider] ERROR creating deposit:', error);
            console.error('[DepositsProvider] Error details:', error.response?.data);
            throw error; // Re-throw to allow caller to handle
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

    const deleteDepositById = async (id) => {
        try {
            const response = await deleteDepositByIdRequest(id);
            return response.data;
        } catch (error) {
            console.error(error);
            throw error;
        }
    };

    async function getDepositsByDate(date) {
        const response = await getDepositsByDateRequest(date);
        setDeposits(response.data);
    }

    return (
        <DepositContext.Provider
            value={{
                deposits,
                loadDeposits,
                createDeposit,
                getDepositsByOrderId,
                deleteDepositById,
                getDepositsByDate
            }}
        >
            {children}
        </DepositContext.Provider>
    );
};
