import { Form, Formik } from "formik";
import { useClients } from "../context/ClientProvider";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

function ClientForm() {
  const { createClient, getClient, updateClient } = useClients();

  const [client, setClient] = useState({
    premises: "",
    clientName: "",
    mall: "",
    phoneNumber: ""
  });
  const params = useParams();
  const navigate = useNavigate();


  useEffect(() => {
    const loadClient = async () => {
      if (params.id) {
        const client = await getClient(params.id);
        console.log('loaded client', client)
        setClient({
          premises: client.premises,
          clientName: client.clientName,
          mall: client.mall,
          phoneNumber: client.phoneNumber
        });
      }
    };
    loadClient();
  }, []);

  return (
    <div>
      <Formik
        initialValues={client}
        enableReinitialize={true}
        onSubmit={async (values, actions) => {
          console.log(values);
          if (params.id) {
            await updateClient(params.id, values);
          } else {
            await createClient(values);
          }
          navigate("/clientes");
          setClient({
            premises: "",
            clientName: "",
            mall: "",
            phoneNumber: ""
          });
        }}
      >
        {({ handleChange, handleSubmit, values, isSubmitting }) => (
          <Form
            onSubmit={handleSubmit}
            className="bg-stone-300 max-w-sm rounded-md p-4 mx-auto mt-10"
          >
            <h1 className="text-xl font-bold uppercase text-center">
              {params.id ? "Editar Cliente" : "Nuevo Cliente"}
            </h1>
            <label className="block text-left py-2">Local:</label>
            <input
              type="text"
              name="premises"
              placeholder="Ej: 105"
              className="px-2 py-1 rounded-sm w-full"
              onChange={handleChange}
              value={values.premises}
            />
            <label className="block text-left py-2">Nombre del cliente:</label>
            <input
              type="text"
              name="clientName"
              placeholder="Nombre del cliente"
              className="px-2 py-1 rounded-sm w-full"
              onChange={handleChange}
              value={values.clientName}
            />
            <label className="block text-left py-2">Centro comercial:</label>
            <select name="mall" placeholder="Centro comercial"
              className="px-2 py-1 rounded-sm w-full"
              onChange={handleChange}
              value={values.mall}>
              <option value="">--Por favor seleccione uno--</option>
              <option value="Unilago">Unilago</option>
              <option value="Alta Tecnología">Alta Tecnología</option>
            </select>
            <label className="block text-left py-2">Celular:</label>
            <input
              type="number"
              name="phoneNumber"
              placeholder="Celular"
              className="px-2 py-1 rounded-sm w-full"
              onChange={handleChange}
              value={values.phoneNumber}
            />
            <div className="py-2" />
            <button
              type="submit"
              disabled={isSubmitting}
              className="block bg-green-500 px-2 py-2 text-white w-full rounded-md">
              {params.id ? <b className="gray-400">{isSubmitting ? "Guardando cliente..." : "GUARDAR"}</b> : <b className="gray-400">{isSubmitting ? "Guardando cliente..." : "CREAR"}</b>}
            </button>
          </Form>
        )}
      </Formik>
    </div >
  );
}

export default ClientForm;
