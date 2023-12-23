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
        console.log(client);
        setClient({
          clientId: client.clientId,
          shopId: client.shopId,
          paymentMethod: client.paymentMethod
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
          navigate("/");
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
            className="bg-slate-300 max-w-sm rounded-md p-4 mx-auto mt-10"
          >
            <h1 className="text-xl font-bold uppercase text-center">
              {params.id ? "Edit Client" : "New Client"}
            </h1>
            <label className="block">premises</label>
            <input
              type="text"
              name="premises"
              placeholder="Local"
              className="px-2 py-1 rounded-sm w-full"
              onChange={handleChange}
              value={values.premises}
            />
            <label className="block">clientName</label>
            <input
              type="text"
              name="clientName"
              placeholder="Nombre de cliente"
              className="px-2 py-1 rounded-sm w-full"
              onChange={handleChange}
              value={values.clientName}
            />

            <label className="block">Centro comercial</label>
            <input
              type="text"
              name="mall"
              placeholder="Centro comercial"
              className="px-2 py-1 rounded-sm w-full"
              onChange={handleChange}
              value={values.mall}
            />

            <label className="block">Celular</label>
            <input
              type="text"
              name="phoneNumber"
              placeholder="Celular"
              className="px-2 py-1 rounded-sm w-full"
              onChange={handleChange}
              value={values.phoneNumber}
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="block bg-indigo-500 px-2 py-1 text-white w-full rounded-md"
            >
              {isSubmitting ? "Saving..." : "Save"}
            </button>
          </Form>
        )}
      </Formik>
    </div>
  );
}

export default ClientForm;
