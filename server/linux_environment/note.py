json

NOTES_FILE = "notes.json"

def load_notes():
    try:
        with open(NOTES_FILE, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

def save_notes(notes):
    with open(NOTES_FILE, "w") as f:
        json.dump(notes, f, indent=4)

def add_note():
    title = input("Enter note title: ")
    content = input("Enter note content: ")
    notes = load_notes()
    notes[title] = content
    save_notes(notes)
    print("Note added successfully!")

def view_note():
    notes = load_notes()
    if not notes:
        print("No notes found.")
        return

    title = input("Enter title of note to view: ")
    if title in notes:
        print(f"\nTitle: {title}\nContent: {notes[title]}")
    else:
        print("Note not found.")

def delete_note():
    notes = load_notes()
    if not notes:
        print("No notes found.")
        return

    title = input("Enter title of note to delete: ")
    if title in notes:
        del notes[title]
        save_notes(notes)
        print("Note deleted successfully!")
    else:
        print("Note not found.")

def list_notes():
    notes = load_notes()
    if not notes:
        print("No notes found.")
        return
    print("\nList of Notes:")
    for title in notes:
        print(f"- {title}")


while True:
    print("\nNote Taking App Menu:")
    print("1. Add Note")
    print("2. View Note")
    print("3. Delete Note")
    print("4. List Notes")
    print("5. Exit")

    choice = input("Enter your choice: ")

    if choice == "1":
        add_note()
    elif choice == "2":
        view_note()
    elif choice == "3":
        delete_note()
    elif choice == "4":
        list_notes()
    elif choice == "5":
        print("Exiting...")
        break
    else:
        print("Invalid choice. Please try again.")