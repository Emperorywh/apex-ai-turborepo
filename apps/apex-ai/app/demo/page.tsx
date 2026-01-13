'use client';

export default function Page() {

    return <div>
        <div>
            Page
        </div>
        <button onClick={async () => {
            const response = await fetch("/api/langchain", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({}),
            });
            const data = await response.json();
            console.log("response", data);
        }}>
            询问天气
        </button>
    </div>;
}