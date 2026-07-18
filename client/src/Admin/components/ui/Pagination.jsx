function Pagination({ page = 1, totalPages = 1, onPrevious, onNext }) {
    return (
        <div className="ui-pagination">
            <button type="button" onClick={onPrevious} disabled={page <= 1}>Previous</button>
            <span>{page} / {totalPages}</span>
            <button type="button" onClick={onNext} disabled={page >= totalPages}>Next</button>
        </div>
    );
}

export default Pagination;
