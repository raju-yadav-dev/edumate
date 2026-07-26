import React, { useState } from "react";
import { ChatProvider } from "./context/ChatContext";
import ChatSidebar from "./components/ChatSidebar";
import ChatHeader from "./components/ChatHeader";
import ChatWindow from "./components/ChatWindow";
import "./Chat.css";

export default function Chat() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <ChatProvider>
            <div className="chat-module-app">
                <ChatSidebar
                    isOpen={isSidebarOpen}
                    onClose={() => setIsSidebarOpen(false)}
                />
                
                {isSidebarOpen && (
                    <div 
                        className="sidebar-backdrop" 
                        onClick={() => setIsSidebarOpen(false)} 
                    />
                )}

                <div className="chat-main-viewport">
                    <ChatHeader onToggleSidebar={() => setIsSidebarOpen(true)} />
                    <ChatWindow />
                </div>
            </div>
        </ChatProvider>
    );
}
