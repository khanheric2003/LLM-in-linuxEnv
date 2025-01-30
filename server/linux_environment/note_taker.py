datetime

def create_note():
    """Creates a new note and saves it to a file."""

    note_content = ""
    while True:
        line = input("Enter a line of text (or type '/done' to finish): ")
        if line.lower() == '/done':
            break
        note_content += line + "\n"

    if not note_content.strip():
        print("Note is empty. Nothing saved.")
        return

    timestamp = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    filename = f"note_{timestamp}.txt"

    try:
        with open(filename, "w") as f:
            f.write(note_content)
        print(f"Note saved as '{filename}'")
    except Exception as e:
        print(f"An error occurred: {e}")


def view_notes():
    """Lists all saved notes and allows the user to view one."""
    import os
    note_files = [f for f in os.listdir() if f.startswith("note_") and f.endswith(".txt")]

    if not note_files:
        print("No notes found.")
        return

    print("\nSaved Notes:")
    for i, filename in enumerate(note_files):
        print(f"{i+1}. {filename}")

    while True:
        try:
            choice = int(input("\nEnter the number of the note to view (or 0 to go back): "))
            if choice == 0:
                break
            if 1 <= choice <= len(note_files):
                with open(note_files[choice - 1], "r") as f:
                    print("\n--- Note Content ---\n")
                    print(f.read())
                    print("--- End of Note ---\n")
                break
            else:
                print("Invalid choice. Please try again.")
        except ValueError:
            print("Invalid input. Please enter a number.")


def main():
    """Main function to run the note-taking app."""
    while True:
        print("\nNote-Taking App Menu:")
        print("1. Create a new note")
        print("2. View saved notes")
        print("3. Exit")

        choice = input("Enter your choice: ")

        if choice == '1':
            create_note()
        elif choice == '2':
            view_notes()
        elif choice == '3':
            print("Exiting...")
            break
        else:
            print("Invalid choice. Please try again.")

if __name__ == "__main__":
    main()