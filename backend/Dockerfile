FROM python:3.13-slim

WORKDIR /app

# Install system dependencies needed for some python packages like psycopg2
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install poetry
RUN pip install poetry==2.1.3

# Copy poetry configuration files
COPY pyproject.toml poetry.lock* ./

# Check if poetry.lock exists, otherwise don't require it explicitly
# We configure poetry not to create a virtual environment inside Docker
RUN poetry config virtualenvs.create false \
    && poetry install --no-root --no-interaction --no-ansi

# Copy application code
COPY . .

# Expose port for FastAPI
EXPOSE 8000

# Start FastAPI server using uvicorn
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
