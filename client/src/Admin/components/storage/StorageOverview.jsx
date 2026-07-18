import "./Storage.css";

import CombinedStorageCard from "./CombinedStorageCard";
import DatabaseStorageCard from "./DatabaseStorageCard";
import SupabaseStorageCard from "./SupabaseStorageCard";

function StorageOverview({ stats = {} }) {

    return (

        <section className="storage-section">

            <div className="storage-header">

                <div>

                    <h2>Storage Overview</h2>

                    <p>
                        Accurate usage across MongoDB and Supabase.
                    </p>

                </div>

            </div>

            <div className="storage-grid">

                <CombinedStorageCard
                    combined={stats.combined}
                    mongodb={stats.mongodb}
                    supabase={stats.supabase}
                />

                <DatabaseStorageCard
                    mongodb={stats.mongodb}
                />

                <SupabaseStorageCard
                    supabase={stats.supabase}
                />

            </div>

        </section>

    );

}

export default StorageOverview;