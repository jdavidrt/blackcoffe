import React from 'react';

const SearchBar = ({ onSearch }) => {
    return (
        <div className="px-2 py-1">
            <input
                type="text"
                placeholder="Buscar..."
                onChange={(e) => onSearch(e.target.value)}
                className="p-2 border rounded-md w-full"
            />
        </div>
    );
};

export default SearchBar;