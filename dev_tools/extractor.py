import json

data = []
with open("gambling-ags.txt", "r") as data_src:
    cnt = 0
    for line in data_src:
        line.strip()
        link = line[2: -2]
        data.append(link)

l = len(data)
with open("../blocklist.json", "w") as json_file:
    for i in range (0, l): 
        tmp = data[i]
        format_data = {
            "id": i + 1,
            "priority": 1,
            "action": { 
                "type": "block" 
            },
            "condition": { 
                "urlFilter": f"||{data[i]}",
                "resourceTypes": ["main_frame"]
            }
        }
        json.dump(format_data, json_file, indent=4)
        json_file.write(",")
        json_file.write("\n")