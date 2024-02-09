import React from 'react';

const SearchBar = ({ onSearch }) => {
    return (
        <div className="px-2 py-1">
            <input
                type="search"
                placeholder="Buscar..."
                onChange={(e) => onSearch(e.target.value)}
                className="p-2 border rounded-md w-full"
                allowCLear
            />
        </div>
    );
};

export default SearchBar;