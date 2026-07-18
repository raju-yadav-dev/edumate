import "./PageContainer.css";

function PageContainer({ children }) {

    return (
        <main className="page-container">

            {children}

        </main>
    );

}

export default PageContainer;