import { FileText, KeyRound, Users } from "lucide-react";

function DataTools({ setActiveSection }) {
    return (
        <section className="admin-panel-card">
            <div className="panel-header-row">
                <div>
                    <h2>Data tools</h2>
                    <p>Operational shortcuts for the knowledge base.</p>
                </div>
            </div>

            <div className="tool-card-grid">
                <button type="button" className="tool-card" onClick={() => setActiveSection("files")}>
                    <FileText />
                    <strong>Open file manager</strong>
                    <span>Browse, upload, preview, and delete documents.</span>
                </button>
                <button type="button" className="tool-card" onClick={() => setActiveSection("users")}>
                    <Users />
                    <strong>Open user manager</strong>
                    <span>Inspect accounts and remove inactive users.</span>
                </button>
                <button type="button" className="tool-card" onClick={() => setActiveSection("keys")}>
                    <KeyRound />
                    <strong>Configure keys</strong>
                    <span>Update provider credentials without leaving the panel.</span>
                </button>
            </div>
        </section>
    );
}

export default DataTools;
