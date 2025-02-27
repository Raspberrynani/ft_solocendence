import os
import sys
from django.core.management.commands.runserver import Command as RunserverCommand
from django.core.management import execute_from_command_line

class Command(RunserverCommand):
    def handle(self, *args, **options):
        # Get SSL certificate paths from environment variables or use defaults
        cert_file = os.environ.get('SSL_CERT_FILE', './certs/cert.pem')
        key_file = os.environ.get('SSL_KEY_FILE', './certs/key.pem')
        
        # Check if certificate files exist
        if not os.path.exists(cert_file) or not os.path.exists(key_file):
            self.stderr.write(self.style.ERROR(
                f"SSL certificate files not found at {cert_file} and {key_file}. "
                f"Please generate them first."
            ))
            return
        
        # Add SSL options
        options['ssl_certificate'] = cert_file
        options['ssl_key'] = key_file
        options['addrport'] = '0.0.0.0:8443'  # Listen on all interfaces at port 8443
        
        super().handle(*args, **options)

if __name__ == '__main__':
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    
    # Create a custom command line with our SSL options
    argv = sys.argv.copy()
    argv.insert(1, 'runserver')
    argv.insert(2, '0.0.0.0:8443')
    argv.insert(3, '--noreload')
    
    # Add SSL certificate options
    cert_file = os.environ.get('SSL_CERT_FILE', './certs/cert.pem')
    key_file = os.environ.get('SSL_KEY_FILE', './certs/key.pem')
    
    # Check if certificate files exist
    if not os.path.exists(cert_file) or not os.path.exists(key_file):
        print(f"SSL certificate files not found at {cert_file} and {key_file}. "
              f"Please generate them first.")
        sys.exit(1)
    
    argv.append(f'--cert={cert_file}')
    argv.append(f'--key={key_file}')
    
    execute_from_command_line(argv)