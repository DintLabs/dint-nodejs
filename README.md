Add all the env variables.
To whitelist the IP, put IP to the validIps array under app.json
To call the API (/api/send-dint/:apiKey), we must need to pass api security key with it. SECURITY_KEY is in the env folder. 
The env folder need to have OWNER_PRIVATE_KEY to call this API.
While calling the parameter, we must need to send this parameter: {
    "sender_id": int,
    "reciever_id":int,
    "amount": int
}