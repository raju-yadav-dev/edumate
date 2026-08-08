import { useEffect } from "react";

/**
 * Reusable hook to register keyboard shortcuts with clean event capturing.
 * Supports ctrl+, shift+, combinations.
 */
export default function useKeyboardShortcuts(shortcutsMap, active = true) {
    useEffect(() => {
        if (!active) return;

        const handleKeyDown = (event) => {
            const target = event.target;
            const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

            const isCtrl = event.ctrlKey || event.metaKey;
            const isShift = event.shiftKey;
            const key = event.key.toLowerCase();

            // Resolve standardized combination keys
            let combo = "";
            if (isCtrl) combo += "ctrl+";
            if (isShift) combo += "shift+";
            combo += key;

            // Handle special keys mapping
            if (event.key === "Escape") combo = "escape";
            if (event.key === "Delete") combo = "delete";
            if (event.key === "Backspace") combo = "backspace";
            if (event.key === "Enter") {
                combo = (isCtrl ? "ctrl+" : "") + (isShift ? "shift+" : "") + "enter";
            }
            if (event.key === "ArrowUp") combo = "arrowup";
            if (event.key === "ArrowDown") combo = "arrowdown";
            if (event.key === "ArrowLeft") combo = "arrowleft";
            if (event.key === "ArrowRight") combo = "arrowright";

            if (shortcutsMap[combo]) {
                // If typing inside an input/textarea, only override general app keys (Enter, Esc, Search, Refresh)
                const isOverridable = [
                    "ctrl+enter",
                    "escape",
                    "ctrl+f",
                    "ctrl+shift+f",
                    "f5"
                ].includes(combo);

                if (isInput && !isOverridable) {
                    return;
                }

                event.preventDefault();
                shortcutsMap[combo](event);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [shortcutsMap, active]);
}
