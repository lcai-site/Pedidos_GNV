import fetch from 'node-fetch';

const API_KEY = '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';
const MODEL = 'nvidia/nemotron-3-nano-30b-a3b:free';

async function test() {
    console.log("Testing OpenRouter Key...");
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: MODEL,
            messages: [{ role: 'user', content: 'Say hello' }]
        })
    });

    if (response.ok) {
        const data = await response.json();
        console.log("Success:", data.choices[0].message.content);
    } else {
        const err = await response.text();
        console.error(`Error ${response.status}:`, err);
    }
}

test();
