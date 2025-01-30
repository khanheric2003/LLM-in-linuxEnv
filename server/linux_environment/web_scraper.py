requests
from bs4 import BeautifulSoup

def scrape_website(url):
    """
    Scrapes a website and extracts all the text content.

    Args:
        url: The URL of the website to scrape.

    Returns:
        A string containing all the text content from the website, 
        or None if there was an error.
    """
    try:
        response = requests.get(url)
        response.raise_for_status()  # Raise an exception for bad status codes

        soup = BeautifulSoup(response.content, "html.parser")
        text = soup.get_text()
        return text
    except requests.exceptions.RequestException as e:
        print(f"Error fetching URL: {e}")
        return None
    except Exception as e:
        print(f"An error occurred: {e}")
        return None


if __name__ == "__main__":
    url = input("Enter the URL to scrape: ")
    scraped_text = scrape_website(url)

    if scraped_text:
        print("\nScraped text:\n")
        print(scraped_text)
        #To save to a file uncomment the following lines
        #with open("scraped_data.txt", "w", encoding="utf-8") as f:
        #    f.write(scraped_text)
        #print("\nScraped data saved to scraped_data.txt")