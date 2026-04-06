
import * as dotenv from 'dotenv';
import fetch from 'node-fetch'; // will use global fetch natively in node 18+

dotenv.config({ path: '.env.production' });

const token = process.env.VITE_MELHOR_ENVIO_TOKEN;
if (!token) {
    console.error("No VITE_MELHOR_ENVIO_TOKEN found.");
    process.exit(1);
}

const uuids = [
    'a15e9499-f98d-468e-bf53-4485c47f74ff',
    'a15e949d-ef3f-4d3b-936f-14f05f7b8a36'
];

async function check() {
    console.log("Checking ME API v2 tracking for UUIDs...", uuids);
    const res = await fetch("https://melhorenvio.com.br/api/v2/me/shipment/tracking", {
        method: "POST",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "User-Agent": "MENVIO_TEST_SCRIPT gnv@test.com"
        },
        body: JSON.stringify({ orders: uuids })
    });
    
    if (!res.ok) {
        console.error("Error from API:", res.status, await res.text());
        return;
    }
    const data = await res.json();
    console.log("ME API Response:", JSON.stringify(data, null, 2));
}

check();
