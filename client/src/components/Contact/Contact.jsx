import "./Contact.css";

function Contact() {
    return (
        <section className="contact">

            <div className="contact-info">

                <h2>Get In Touch</h2>

                <p>
                    Have questions about EduMate? We'd love to hear from you.
                </p>

                <div className="info-box">

                    <h3>📍 Address</h3>

                    <p>Brainware University, Barasat, West Bengal</p>

                </div>

                <div className="info-box">

                    <h3>📧 Email</h3>

                    <p>support@edumate.com</p>

                </div>

                <div className="info-box">

                    <h3>📞 Phone</h3>

                    <p>+91 98765 43210</p>

                </div>

            </div>

            <div className="contact-form">

                <form>

                    <input
                        type="text"
                        placeholder="Full Name"
                    />

                    <input
                        type="email"
                        placeholder="Email Address"
                    />

                    <input
                        type="text"
                        placeholder="Subject"
                    />

                    <textarea
                        rows="6"
                        placeholder="Write your message..."
                    ></textarea>

                    <button>
                        Send Message
                    </button>

                </form>

            </div>

        </section>
    );
}

export default Contact;