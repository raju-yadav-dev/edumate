import "./Button.css";

function Button({ text, type, onClick, buttonType = "button" }) {

    return (
        <button className={type} type={buttonType} onClick={onClick}>
            {text}
        </button>
    );

}

export default Button;
