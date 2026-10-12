
CREATE TABLE books (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    genre VARCHAR(50),
    published_year INT
);

INSERT INTO books (title, genre, published_year)
VALUES
    ('The Hobbit', 'fantasy', 1937),
    ('1984', 'dystopian', 1949),
    ('Pippi Longstocking', 'children', 1945),
    ('The Hunger Games', 'dystopian', 2008);

CREATE TABLE authors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

INSERT INTO authors (name)
VALUES
    ('J.R.R. Tolkien'),
    ('George Orwell'),
    ('Astrid Lindgren'),
    ('Suzanne Collins');

ALTER TABLE books
ADD COLUMN author_id INT REFERENCES authors(id);

UPDATE books
SET author_id = (
    SELECT id FROM authors
    WHERE name = 'J.R.R. Tolkien'
)
WHERE title = 'The Hobbit';

UPDATE books
SET author_id = (
    SELECT id FROM authors
    WHERE name = 'George Orwell'
)
WHERE title = '1984';

UPDATE books
SET author_id = (
    SELECT id FROM authors
    WHERE name = 'Astrid Lindgren'
)
WHERE title = 'Pippi Longstocking';

UPDATE books
SET author_id = (
    SELECT id FROM authors
    WHERE name = 'Suzanne Collins'
)
WHERE title = 'The Hunger Games';

CREATE TABLE members (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE loans (
    id SERIAL PRIMARY KEY,
    book_id INT NOT NULL REFERENCES books(id),
    member_id INT NOT NULL REFERENCES members(id),
    borrowed_at TIMESTAMP DEFAULT NOW(),
    returned_at TIMESTAMP
);

CREATE UNIQUE INDEX one_active_loan_per_book
ON loans(book_id)
WHERE returned_at IS NULL;
