import "./App.css";

import Navbar from "./components/Navbar/Navbar";
import Hero from "./components/Hero/Hero";
import Features from "./components/Features/Features";
import About from "./components/About/About";
import Statistics from "./components/Statistics/Statistics";
import FAQ from "./components/FAQ/FAQ";
import Contact from "./components/Contact/Contact";
import Footer from "./components/Footer/Footer";

function App() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="page-stack">
        <Hero />
        <Features />
        <About />
        <Statistics />
        <FAQ />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}

export default App;