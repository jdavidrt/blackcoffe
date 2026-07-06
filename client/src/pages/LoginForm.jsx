import React from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import { useUsers } from '../context/UserProvider';
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

const LoginForm = () => {
    const navigate = useNavigate();
    const { autenticateUser } = useUsers();
    const [user, setUser] = useState({
        userName: ""
    });

    const handleLogin = async (values, { setSubmitting }) => {
        // Single call — the provider now updates its own context inside autenticateUser,
        // so a second call is no longer needed just to populate local state.
        const response = await autenticateUser(values.username, values.pass);
        if (!response || response.success === false) {
            alert('Credenciales incorrectas')
            localStorage.setItem('user', '');
        } else {
            localStorage.setItem('user', response.userName);
            setUser(response);
            navigate("/");
        }
        setSubmitting(false);
    };

    return (
        <Formik
            initialValues={{ username: '', pass: '' }}
            validate={(values) => {
                const errors = {};
                if (!values.username) {
                    errors.username = 'Campo requerido';
                }
                if (!values.pass) {
                    errors.pass = 'Campo requerido';
                }
                return errors;
            }}
            onSubmit={handleLogin}
        >
            {({ isSubmitting }) => (
                <Form className="max-w-md mx-auto mt-8">
                    <div className="mb-4">
                        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="username">
                            Usuario:
                        </label>
                        <Field
                            type="text"
                            id="username"
                            name="username"
                            className="appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        />
                        <ErrorMessage name="username" component="div" className="text-red-500 text-xs" />
                    </div>
                    <div className="mb-6">
                        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
                            Contraseña:
                        </label>
                        <Field
                            type="password"
                            id="pass"
                            name="pass"
                            className="appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        />
                        <ErrorMessage name="password" component="div" className="text-red-500 text-xs" />
                    </div>
                    <button
                        type="submit"
                        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Autenticando...' : 'Iniciar sesión'}
                    </button>
                </Form>
            )}
        </Formik>
    );
};

export default LoginForm;
