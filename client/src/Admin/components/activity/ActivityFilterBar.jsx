import React, { useMemo } from "react";
import { Search, Calendar, RotateCcw } from "lucide-react";

export default function ActivityFilterBar({
    logs = [],
    searchQuery,
    setSearchQuery,
    userFilter,
    setUserFilter,
    actionFilter,
    setActionFilter,
    serviceFilter,
    setServiceFilter,
    dateRange,
    setDateRange,
    onClearFilters
}) {
    // Dynamically derive unique Users, Actions, and Services from the live logs array
    const userOptions = useMemo(() => {
        const set = new Set();
        logs.forEach((l) => { if (l.user) set.add(l.user); });
        return ["All Users", ...Array.from(set)];
    }, [logs]);

    const actionOptions = useMemo(() => {
        const set = new Set();
        logs.forEach((l) => { if (l.action) set.add(l.action); });
        return ["All Actions", ...Array.from(set)];
    }, [logs]);

    const serviceOptions = useMemo(() => {
        const set = new Set();
        logs.forEach((l) => { if (l.service) set.add(l.service); });
        return ["All Services", ...Array.from(set)];
    }, [logs]);

    return (
        <div className="activity-filter-bar">
            <div className="filter-controls-group">
                {/* Date Range Picker */}
                <div className="filter-select-wrapper date-picker-wrapper">
                    <Calendar size={14} className="input-icon" />
                    <select
                        className="filter-select date-select"
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                    >
                        <option value="All Time">All Time</option>
                        <option value="Today">Today</option>
                        <option value="Yesterday">Yesterday</option>
                        <option value="Last 7 Days">Last 7 Days</option>
                        <option value="Last 30 Days">Last 30 Days</option>
                    </select>
                </div>

                {/* Dynamic Users Filter */}
                <div className="filter-select-wrapper">
                    <select
                        className="filter-select"
                        value={userFilter}
                        onChange={(e) => setUserFilter(e.target.value)}
                    >
                        {userOptions.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
                </div>

                {/* Dynamic Actions Filter */}
                <div className="filter-select-wrapper">
                    <select
                        className="filter-select"
                        value={actionFilter}
                        onChange={(e) => setActionFilter(e.target.value)}
                    >
                        {actionOptions.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
                </div>

                {/* Dynamic Services Filter */}
                <div className="filter-select-wrapper">
                    <select
                        className="filter-select"
                        value={serviceFilter}
                        onChange={(e) => setServiceFilter(e.target.value)}
                    >
                        {serviceOptions.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
                </div>

                {/* Search Logs Input */}
                <div className="filter-search-input-wrapper">
                    <Search size={14} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search logs..."
                        className="filter-search-input"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Clear Filters Button */}
                <button
                    type="button"
                    className="clear-filters-btn"
                    onClick={onClearFilters}
                >
                    <RotateCcw size={13} /> Clear Filters
                </button>
            </div>
        </div>
    );
}
