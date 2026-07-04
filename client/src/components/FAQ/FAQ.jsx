import { useState } from "react";
import "./FAQ.css";

function FAQ() {

    const faqs = [
        {
            question: "What is EduMate?",
            answer: "EduMate is an AI-powered educational assistant that helps students, teachers, and staff get instant answers from institutional documents."
        },
        {
            question: "Who can use EduMate?",
            answer: "Students, teachers, administrators, and visitors can use EduMate based on their assigned roles."
        },
        {
            question: "Can EduMate answer questions from PDFs?",
            answer: "Yes. EduMate uses Retrieval-Augmented Generation (RAG) to answer questions from uploaded PDFs and documents."
        },
        {
            question: "Does EduMate support multiple languages?",
            answer: "Yes. EduMate is designed to support multiple languages for better accessibility."
        },
        {
            question: "Is chat history saved?",
            answer: "Yes. Logged-in users can access their previous conversations anytime."
        }
    ];

    const [activeIndex, setActiveIndex] = useState(null);

    function toggleFAQ(index) {

        if (activeIndex === index) {
            setActiveIndex(null);
        } else {
            setActiveIndex(index);
        }

    }

    return (

        <section id="faq" className="faq">

            <div className="faq-heading">

                <h2>Frequently Asked Questions</h2>

                <p>
                    Everything you need to know about EduMate.
                </p>

            </div>

            <div className="faq-container">

                {

                    faqs.map((faq, index) => (

                        <div className="faq-item" key={index}>

                            <button
                                className="faq-question"
                                onClick={() => toggleFAQ(index)}
                            >

                                <span>{faq.question}</span>

                                <span>
                                    {activeIndex === index ? "-" : "+"}
                                </span>

                            </button>

                            <div
                                className={`faq-answer ${activeIndex === index ? "active" : ""
                                    }`}
                            >
                                <p>{faq.answer}</p>
                            </div>

                        </div>

                    ))

                }

            </div>

        </section>

    );

}

export default FAQ;