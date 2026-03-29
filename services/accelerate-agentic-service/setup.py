from setuptools import setup, find_packages

setup(
    name='accelerate-agentic-service',
    version='0.1.0',
    description='Reporting and alerting microservice for internal use',
    author='accelerate',
    author_email='your.email@domain.com',
    url='https://github.corp.inmobi.com/accelerate/accelerate-agentic-service',
    license='MIT',
    packages=find_packages(exclude=['.venv', 'buildParams', 'helm']),
    include_package_data=True,
    install_requires=[
        # You can leave this empty if using requirements.txt
    ],
    extras_require={
        'dev': ['check-manifest'],
        'test': ['pytest', 'pytest-cov'],
    },
    classifiers=[
        'Development Status :: 3 - Alpha',
        'Intended Audience :: Developers',
        'Programming Language :: Python :: 3',
        'License :: OSI Approved :: MIT License',
        'Topic :: Software Development :: Testing',
    ],
    python_requires='>=3.7',
)
