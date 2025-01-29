import re
import requests
from typing import Dict, Union, List

class OpenAIKeyValidator:
    def __init__(self):
        self.base_url = "https://api.openai.com/v1"
    
    def check_key_format(self, api_key: str) -> bool:
        """
        Check if the API key matches the expected format.
        OpenAI API keys typically start with 'sk-' and are 51 characters long.
        """
        pattern = r'^sk-[A-Za-z0-9]{48}$'
        return bool(re.match(pattern, api_key))
    
    def validate_key(self, api_key: str) -> Dict[str, Union[bool, str]]:
        """
        Validate the OpenAI API key by checking its format and testing it against the API.
        """
        try:
            headers = {
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            }
            
            response = requests.get(
                f"{self.base_url}/models",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                return {
                    'valid': True,
                    'message': 'API key is valid and working'
                }
            elif response.status_code == 401:
                return {
                    'valid': False,
                    'message': 'Invalid API key'
                }
            else:
                error_msg = response.json().get('error', {}).get('message', 'Unknown error')
                return {
                    'valid': False,
                    'message': f'API error: {error_msg}'
                }
                
        except requests.exceptions.RequestException as e:
            return {
                'valid': False,
                'message': f'Network error: {str(e)}'
            }
    
    def chat_with_gpt(self, api_key: str, message: str, system_prompt: str = None) -> Dict[str, Union[bool, str]]:
        """
        Send a message to ChatGPT and get a response.
        
        Args:
            api_key (str): The OpenAI API key
            message (str): The message to send to ChatGPT
            system_prompt (str, optional): System prompt to set context
            
        Returns:
            dict: Dictionary containing response with keys:
                - 'success': bool indicating if the request was successful
                - 'message': str containing the response or error message
        """
        try:
            headers = {
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            }
            
            messages: List[Dict[str, str]] = []
            
            if system_prompt:
                messages.append({
                    "role": "system",
                    "content": system_prompt
                })
                
            messages.append({
                "role": "user",
                "content": message
            })
            
            data = {
                "model": "gpt-3.5-turbo",  # You can change to other models like "gpt-4" if available
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": 800
            }
            
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=data,
                timeout=30
            )
            
            if response.status_code == 200:
                response_data = response.json()
                return {
                    'success': True,
                    'message': response_data['choices'][0]['message']['content']
                }
            else:
                error_msg = response.json().get('error', {}).get('message', 'Unknown error')
                return {
                    'success': False,
                    'message': f'API error: {error_msg}'
                }
                
        except requests.exceptions.RequestException as e:
            return {
                'success': False,
                'message': f'Network error: {str(e)}'
            }

def main():
    """
    Example usage of the OpenAIKeyValidator class with chat functionality
    """
    validator = OpenAIKeyValidator()
    
    # Your API key
    api_key = ""
    
    # First validate the key
    result = validator.validate_key(api_key)
    print(f"API Key Valid: {result['valid']}")
    print(f"Validation Message: {result['message']}")
    
    if result['valid']:
        # If key is valid, start chat interaction
        while True:
            user_input = input("\nEnter your message (or 'quit' to exit): ")
            
            if user_input.lower() in ['quit', 'exit', 'q']:
                break
                
            # Optional system prompt
            system_prompt = "You are a helpful AI assistant."
            
            # Get response from ChatGPT
            chat_result = validator.chat_with_gpt(api_key, user_input, system_prompt)
            
            if chat_result['success']:
                print("\nChatGPT:", chat_result['message'])
            else:
                print("\nError:", chat_result['message'])

if __name__ == "__main__":
    main()