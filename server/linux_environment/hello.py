# Import the necessary library
import sys

# Plan the code structure
def main():
    """Print "Hello, world!" to the console."""
    try:
        # Implement with proper error handling
        print("Hello, world!")
    except Exception as e:
        # Handle errors appropriately
        print(f"An error occurred: {e}")
        sys.exit(1)

# Test for completeness
if __name__ == "__main__":
    main()