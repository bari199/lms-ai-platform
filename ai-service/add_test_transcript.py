
import asyncio

from app.core.database import create_db_pool


LECTURE_ID = "4c750244-e56d-4239-8f86-7e0238fdbf89"

TEST_TRANSCRIPT = """
JavaScript is a programming language commonly used to build
interactive websites and web applications.

JavaScript variables store data values. The three common ways
to declare variables are var, let, and const.

The let keyword allows a variable to be reassigned.
The const keyword declares a variable that cannot be reassigned.
The var keyword is the older way to declare variables and has
function scope.

JavaScript supports several data types, including string,
number, boolean, undefined, null, object, and symbol.

A string represents text. A number represents numeric values.
A boolean represents true or false.

JavaScript operators perform operations on values.
Arithmetic operators include addition, subtraction,
multiplication, division, and remainder.

Conditional statements allow programs to make decisions.
The if statement executes code when a condition is true.
The else statement executes alternative code when the
condition is false.

These foundational concepts help beginners understand
JavaScript programming.
"""


async def main():
    pool = await create_db_pool()

    try:
        async with pool.acquire() as connection:
            result = await connection.execute(
                """
                UPDATE lectures
                SET transcript = $1
                WHERE id = $2
                  AND NULLIF(BTRIM(transcript), '') IS NULL
                """,
                TEST_TRANSCRIPT,
                LECTURE_ID,
            )

            print("Transcript update:", result)

    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
