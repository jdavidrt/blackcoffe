import { useOrders } from "../context/OrderProvider";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import dayjs from "dayjs"; import {
    Document,
    Text,
    Page,
    StyleSheet,
    Image,
    View,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
    page: {
        backgroundColor: "#E4E4E4",
        padding: 30,
    },
    title: {
        fontSize: 24,
        textAlign: "center",
        fontWeight: "bold",
    },
    section: {
        display: "flex",
        flexDirection: "row",
        margin: 10,
        padding: 10,
    },
    parragraph: {
        fontSize: 12,
        textAlign: "justify",
        lineHeight: 1.5,
        margin: 10,
    },
    pageNumber: {
        position: "absolute",
        fontSize: 12,
        bottom: 30,
        left: 0,
        right: 0,
        textAlign: "center",
        color: "grey",
    }
});


function Invoice() {
    const params = useParams();

    const { getOrder } = useOrders();
    const [cart, setCart] = useState([]);
    const [order, setOrder] = useState({
        clientId: "",
        shopId: "1",
        items: ""
    });
    const [platformPayment, setPlatformPayment] = useState(false);
    const fechaActual = dayjs().format('YYYY-MM-DD');

    const calculateTotal = () => {
        return cart.reduce((total, item) => total + item.unitValue * item.quantity, 0);
    };

    function togglePlatform() {
        setPlatformPayment(!platformPayment); // Cambiar el valor de verdadero a falso y viceversa
    }

    useEffect(() => {
        const loadOrder = async () => {
            if (params.id) {
                const order = await getOrder(params.id);
                setCart(JSON.parse(order.items))

                setOrder({
                    clientId: order.clientId,
                    shopId: 1,
                    items: cart,
                    clientName: order.clientName,
                    premises: order.premises,
                    createdAt: order.createdAt.slice(0, 10),
                    paid: order.paid,
                    paidAt: order.paidAt.slice(0, 10),
                    deposit: order.deposit
                });
            }
        };
        loadOrder();
    }, []);
    console.log(cart)

    return (

        <div className="invoice">
            <div className="header">
                <div className="logo">Black Coffe</div>
                <div className="company-info">
                    <div>NIT: 8074330-5</div>
                    <div>Teléfono: 3505410817</div>
                </div>
            </div>
            <div className="content">
                <div className="order-info">
                    <div>Cliente: {order.clientName} - {order.premises}</div>
                    <div>Fecha de Creación: {order.createdAt}</div>
                    <div>Fecha de Pago: {order.paidAt}</div>
                    <div>Valor Total: ${calculateTotal()}</div>
                </div>
                {cart.map((product) => (
                    <li key={product.id}>
                        {product.productName} - Cantidad: {product.quantity} - Valor Unitario: ${product.unitValue}
                    </li>
                ))}
            </div>
        </div>
    );
}

export default Invoice;
