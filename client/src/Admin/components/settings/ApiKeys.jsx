function ApiKeys({ apiKeys, setApiKeys, saveKeys, savingKeys }) {
    return (
        <section className="admin-panel-card">
            <div className="panel-header-row">
                <div>
                    <h2>API keys</h2>
                    <p>Store Groq and OpenRouteService credentials for the server.</p>
                </div>
            </div>

            <form className="keys-form" onSubmit={saveKeys}>
                <label>
                    <span>Groq API key(s)</span>
                    <textarea
                        rows="4"
                        value={apiKeys.groqApiKey}
                        onChange={(event) => setApiKeys((current) => ({ ...current, groqApiKey: event.target.value }))}
                        placeholder="Comma-separated keys"
                    />
                </label>
                <label>
                    <span>OpenRouteService API key</span>
                    <input
                        type="text"
                        value={apiKeys.openRouteServiceKey}
                        onChange={(event) =>
                            setApiKeys((current) => ({ ...current, openRouteServiceKey: event.target.value }))
                        }
                        placeholder="Paste API key"
                    />
                </label>

                <button type="submit" className="primary-action" disabled={savingKeys}>
                    {savingKeys ? "Saving..." : "Save keys"}
                </button>
            </form>
        </section>
    );
}

export default ApiKeys;
