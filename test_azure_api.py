import os
from dotenv import load_dotenv
import requests
import json

# Load environment variables from .env file
load_dotenv()

def test_azure_openai():
    # Get configuration from environment variables
    endpoint = os.getenv('VITE_AZURE_OPENAI_ENDPOINT')
    deployment_id = os.getenv('VITE_AZURE_OPENAI_DEPLOYMENT_ID')
    api_key = os.getenv('VITE_AZURE_OPENAI_API_KEY')
    api_version = os.getenv('VITE_AZURE_OPENAI_API_VERSION', '2024-02-15-preview')

    # Print configuration (without API key for security)
    print(f"Configuration:")
    print(f"Endpoint: {endpoint}")
    print(f"Deployment ID: {deployment_id}")
    print(f"API Version: {api_version}")
    print(f"API Key: {'*' * 10}")

    # Check if all required variables are set
    if not all([endpoint, deployment_id, api_key]):
        print("Error: Missing required environment variables")
        return

    # Prepare the API URL
    url = f"{endpoint}/openai/deployments/{deployment_id}/chat/completions"
    
    # Prepare headers
    headers = {
        'Content-Type': 'application/json',
        'api-key': api_key
    }

    # Prepare the request body
    body = {
        "messages": [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "What is 2+2?"}
        ],
        "max_tokens": 100,
        "temperature": 0.7
    }

    try:
        # Add api-version as query parameter
        params = {
            'api-version': api_version
        }

        # Make the request
        print("\nMaking request to Azure OpenAI...")
        response = requests.post(url, headers=headers, params=params, json=body)

        # Check if request was successful
        response.raise_for_status()

        # Parse and print the response
        result = response.json()
        print("\nResponse:")
        print(f"Status Code: {response.status_code}")
        if 'choices' in result and len(result['choices']) > 0:
            answer = result['choices'][0]['message']['content']
            print(f"Answer: {answer}")
        else:
            print("No answer in response")
            print("Full response:", json.dumps(result, indent=2))

    except requests.exceptions.RequestException as e:
        print("\nError occurred:")
        print(f"Status code: {e.response.status_code if hasattr(e, 'response') else 'N/A'}")
        print(f"Error message: {str(e)}")
        if hasattr(e, 'response') and e.response is not None:
            try:
                error_detail = e.response.json()
                print("Error details:", json.dumps(error_detail, indent=2))
            except:
                print("Raw error response:", e.response.text)

if __name__ == "__main__":
    test_azure_openai()