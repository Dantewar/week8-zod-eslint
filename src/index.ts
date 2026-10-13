import express, { type Request, type Response } from "express";
import { z } from "zod";
import { pool } from "./db.js";
import { env } from "./env.js";
import {
  bookSchema,
  idParamSchema,
  type Book,
} from "./schemas.js";

const app = express();
const PORT = env.PORT;

app.use(express.json());

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
};

const getErrorCode = (error: unknown): string | undefined => {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return undefined;
};

// Welcome
app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    message: "Welcome to the Library API",
  });
});

// Get all books
app.get("/books", async (req: Request, res: Response) => {
  const { genre, sort } = req.query;
  const allowedSorts = ["title", "published_year", "genre"];

  if (genre !== undefined && typeof genre !== "string") {
    return res.status(400).json({
      message: "Invalid genre",
    });
  }

  if (
    sort !== undefined &&
    (typeof sort !== "string" || !allowedSorts.includes(sort))
  ) {
    return res.status(400).json({
      message: "Invalid sort field",
    });
  }

  try {
    let query = "SELECT * FROM books";
    const values: string[] = [];

    if (genre !== undefined) {
      query += " WHERE genre = $1";
      values.push(genre);
    }

    query += sort ? ` ORDER BY ${sort}` : " ORDER BY id";

    const result = await pool.query<Book>(query, values);

    res.status(200).json(result.rows);
  } catch (error) {
    console.error(getErrorMessage(error));

    res.status(500).json({
      message: "Failed to fetch books",
    });
  }
});

// Get one book
app.get("/books/:id", async (req: Request, res: Response) => {
  const parsedParams = idParamSchema.safeParse(req.params);

  if (!parsedParams.success) {
    return res.status(400).json({
      errors: z.flattenError(parsedParams.error),
    });
  }

  const { id } = parsedParams.data;

  try {
    const result = await pool.query<Book>(
      "SELECT * FROM books WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Book not found",
      });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(getErrorMessage(error));

    res.status(500).json({
      message: "Failed to fetch book",
    });
  }
});

// Create a book
app.post("/books", async (req: Request, res: Response) => {
  const parsedBook = bookSchema.safeParse(req.body);

  if (!parsedBook.success) {
    return res.status(400).json({
      errors: z.flattenError(parsedBook.error),
    });
  }

  const {
    title,
    genre,
    published_year,
    author_id,
  } = parsedBook.data;

  try {
    const result = await pool.query<Book>(
      `INSERT INTO books (
         title,
         genre,
         published_year,
         author_id
       )
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        title,
        genre ?? null,
        published_year ?? null,
        author_id ?? null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (getErrorCode(error) === "23503") {
      return res.status(400).json({
        message: "Author does not exist",
      });
    }

    console.error(getErrorMessage(error));

    res.status(500).json({
      message: "Failed to create book",
    });
  }
});

// Update a complete book
app.put("/books/:id", async (req: Request, res: Response) => {
  const parsedParams = idParamSchema.safeParse(req.params);

  if (!parsedParams.success) {
    return res.status(400).json({
      errors: z.flattenError(parsedParams.error),
    });
  }

  const parsedBook = bookSchema.safeParse(req.body);

  if (!parsedBook.success) {
    return res.status(400).json({
      errors: z.flattenError(parsedBook.error),
    });
  }

  const { id } = parsedParams.data;

  const {
    title,
    genre,
    published_year,
    author_id,
  } = parsedBook.data;

  try {
    const result = await pool.query<Book>(
      `UPDATE books
       SET
         title = $1,
         genre = $2,
         published_year = $3,
         author_id = $4
       WHERE id = $5
       RETURNING *`,
      [
        title,
        genre ?? null,
        published_year ?? null,
        author_id ?? null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Book not found",
      });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    if (getErrorCode(error) === "23503") {
      return res.status(400).json({
        message: "Author does not exist",
      });
    }

    console.error(getErrorMessage(error));

    res.status(500).json({
      message: "Failed to update book",
    });
  }
});

// Partially update a book
app.patch("/books/:id", async (req: Request, res: Response) => {
  const parsedParams = idParamSchema.safeParse(req.params);

  if (!parsedParams.success) {
    return res.status(400).json({
      errors: z.flattenError(parsedParams.error),
    });
  }

  const { id } = parsedParams.data;
  const body = req.body;

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length === 0
  ) {
    return res.status(400).json({
      message: "Request body cannot be empty",
    });
  }

  const allowedFields = [
    "title",
    "genre",
    "published_year",
  ];

  if (
    Object.keys(body).some(
      (field) => !allowedFields.includes(field)
    )
  ) {
    return res.status(400).json({
      message: "Invalid book field",
    });
  }

  const { title, genre, published_year } = body;

  if (
    (title !== undefined &&
      (typeof title !== "string" || !title.trim())) ||
    (genre !== undefined &&
      genre !== null &&
      typeof genre !== "string") ||
    (published_year !== undefined &&
      published_year !== null &&
      !Number.isInteger(published_year))
  ) {
    return res.status(400).json({
      message: "Invalid book data",
    });
  }

  try {
    const result = await pool.query<Book>(
      `UPDATE books
       SET
         title = COALESCE($1, title),
         genre = COALESCE($2, genre),
         published_year = COALESCE($3, published_year)
       WHERE id = $4
       RETURNING *`,
      [
        title === undefined ? null : title.trim(),
        genre ?? null,
        published_year ?? null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Book not found",
      });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(getErrorMessage(error));

    res.status(500).json({
      message: "Failed to partially update book",
    });
  }
});

// Delete a book
app.delete("/books/:id", async (req: Request, res: Response) => {
  const parsedParams = idParamSchema.safeParse(req.params);

  if (!parsedParams.success) {
    return res.status(400).json({
      errors: z.flattenError(parsedParams.error),
    });
  }

  const { id } = parsedParams.data;

  try {
    const result = await pool.query<Book>(
      "DELETE FROM books WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Book not found",
      });
    }

    res.status(200).json({
      message: "Book deleted successfully",
      book: result.rows[0],
    });
  } catch (error) {
    if (getErrorCode(error) === "23503") {
      return res.status(409).json({
        message: "Cannot delete a book with loan records",
      });
    }

    console.error(getErrorMessage(error));

    res.status(500).json({
      message: "Failed to delete book",
    });
  }
});

// Get all authors
app.get("/authors", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT * FROM authors ORDER BY id"
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error(getErrorMessage(error));

    res.status(500).json({
      message: "Failed to fetch authors",
    });
  }
});

// Create an author
app.post("/authors", async (req: Request, res: Response) => {
  const { name } = req.body ?? {};

  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({
      message: "Author name is required",
    });
  }

  try {
    const result = await pool.query(
      "INSERT INTO authors (name) VALUES ($1) RETURNING *",
      [name.trim()]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(getErrorMessage(error));

    res.status(500).json({
      message: "Failed to create author",
    });
  }
});

// Get books by author
app.get(
  "/authors/:id/books",
  async (req: Request, res: Response) => {
    const parsedParams = idParamSchema.safeParse(req.params);

    if (!parsedParams.success) {
      return res.status(400).json({
        errors: z.flattenError(parsedParams.error),
      });
    }

    const { id } = parsedParams.data;

    try {
      const author = await pool.query(
        "SELECT id FROM authors WHERE id = $1",
        [id]
      );

      if (author.rows.length === 0) {
        return res.status(404).json({
          message: "Author not found",
        });
      }

      const result = await pool.query(
        `SELECT
           books.id,
           books.title,
           books.genre,
           books.published_year,
           books.author_id,
           authors.name AS author_name
         FROM books
         JOIN authors
           ON books.author_id = authors.id
         WHERE authors.id = $1
         ORDER BY books.id`,
        [id]
      );

      res.status(200).json(result.rows);
    } catch (error) {
      console.error(getErrorMessage(error));

      res.status(500).json({
        message: "Failed to fetch author's books",
      });
    }
  }
);

// Create a library member
app.post("/members", async (req: Request, res: Response) => {
  const { name, email } = req.body ?? {};

  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({
      message: "Member name is required",
    });
  }

  if (
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
    return res.status(400).json({
      message: "Valid email is required",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO members (name, email)
       VALUES ($1, $2)
       RETURNING *`,
      [name.trim(), email.trim()]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (getErrorCode(error) === "23505") {
      return res.status(409).json({
        message: "Email already exists",
      });
    }

    console.error(getErrorMessage(error));

    res.status(500).json({
      message: "Failed to create member",
    });
  }
});

// Borrow a book
app.post("/loans", async (req: Request, res: Response) => {
  const { book_id, member_id } = req.body ?? {};

  if (
    !Number.isSafeInteger(book_id) ||
    book_id <= 0 ||
    !Number.isSafeInteger(member_id) ||
    member_id <= 0
  ) {
    return res.status(400).json({
      message: "Valid book_id and member_id are required",
    });
  }

  try {
    const activeLoan = await pool.query(
      `SELECT id FROM loans
       WHERE book_id = $1
       AND returned_at IS NULL`,
      [book_id]
    );

    if (activeLoan.rows.length > 0) {
      return res.status(409).json({
        message: "Book is already borrowed",
      });
    }

    const result = await pool.query(
      `INSERT INTO loans (book_id, member_id)
       VALUES ($1, $2)
       RETURNING *`,
      [book_id, member_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (getErrorCode(error) === "23505") {
      return res.status(409).json({
        message: "Book is already borrowed",
      });
    }

    if (getErrorCode(error) === "23503") {
      return res.status(400).json({
        message: "Book or member does not exist",
      });
    }

    console.error(getErrorMessage(error));

    res.status(500).json({
      message: "Failed to create loan",
    });
  }
});

// Return a borrowed book
app.patch(
  "/loans/:id/return",
  async (req: Request, res: Response) => {
    const parsedParams = idParamSchema.safeParse(req.params);

    if (!parsedParams.success) {
      return res.status(400).json({
        errors: z.flattenError(parsedParams.error),
      });
    }

    const { id } = parsedParams.data;

    try {
      const result = await pool.query(
        `UPDATE loans
         SET returned_at = NOW()
         WHERE id = $1
         AND returned_at IS NULL
         RETURNING *`,
        [id]
      );

      if (result.rows.length > 0) {
        return res.status(200).json({
          message: "Book returned successfully",
          loan: result.rows[0],
        });
      }

      const existingLoan = await pool.query(
        "SELECT id FROM loans WHERE id = $1",
        [id]
      );

      if (existingLoan.rows.length === 0) {
        return res.status(404).json({
          message: "Loan not found",
        });
      }

      res.status(409).json({
        message: "Book has already been returned",
      });
    } catch (error) {
      console.error(getErrorMessage(error));

      res.status(500).json({
        message: "Failed to return book",
      });
    }
  }
);

// Get member loan history
app.get(
  "/members/:id/loans",
  async (req: Request, res: Response) => {
    const parsedParams = idParamSchema.safeParse(req.params);

    if (!parsedParams.success) {
      return res.status(400).json({
        errors: z.flattenError(parsedParams.error),
      });
    }

    const { id } = parsedParams.data;

    try {
      const member = await pool.query(
        "SELECT id FROM members WHERE id = $1",
        [id]
      );

      if (member.rows.length === 0) {
        return res.status(404).json({
          message: "Member not found",
        });
      }

      const result = await pool.query(
        `SELECT
           loans.id,
           loans.book_id,
           books.title AS book_title,
           loans.member_id,
           members.name AS member_name,
           loans.borrowed_at,
           loans.returned_at
         FROM loans
         JOIN books
           ON loans.book_id = books.id
         JOIN members
           ON loans.member_id = members.id
         WHERE members.id = $1
         ORDER BY
           loans.borrowed_at DESC,
           loans.id DESC`,
        [id]
      );

      res.status(200).json(result.rows);
    } catch (error) {
      console.error(getErrorMessage(error));

      res.status(500).json({
        message: "Failed to fetch member loans",
      });
    }
  }
);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});