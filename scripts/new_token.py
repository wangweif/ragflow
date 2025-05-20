import requests
import json

# # 1. 先登录获取cookie
# login_url = "http://know.baafs.net.cn/v1/user/login"
# login_data = {
#     "email": "admin@bjzntd.com",
#     "password": "Pg9WHt9UdxhoUiFVs8uZjWdQP9e66iAKFElOUV43Q4iWl4mfEPHgbVhrAc+GyAwGxPd8uPB97nb4jRaFp/V8Pr6zD1hpvJrk1gxi9/Na0m9rGaVZV04M8wSXnZhIfMgtr0wclSieneCvxeiA2WAalynFOMAVV+37H8lL/pkvIjyHrIyDZwY2Q4XzNa9NZBBl1UNoyw1eTbFKI5hWqwFNynUNJRkwVkezrfI5TdW5S71XziM9U8vckiDHU2iLwvHS73/l7L+YdrEKtNu98LJAWqxD4YxtgJKB6288l4LkjD9G6KFQZCYOnI1sgG0ZyikObv3SnDXNwZyx/brxPc5TWQ=="
# }
# session = requests.Session()
# # response = session.post(login_url, json=login_data)
# # print(response.json()['data']['access_token'])

# headers 信息从浏览器获取
headers = {
    "Authorization": "ImQwODY2ZmM4MzUxNzExZjBhNThhMDk2ODEwMDYyMjNkIg.aCvXhA.2sLC0oLfC87MzLgrzrL31D-Ap5M",
    "Content-Type": "application/json",
    "Cookie": "session=RS3_DRofXJ3LEbvLENQQt-uq9FIOqdico_3Y-OJkucc"
}
# 2. 生成系统级API token
token_url = "http://know.baafs.net.cn/v1/api/new_token"
body = {
    "tenant_id": "",
    "dialog_id": ""
}
response = requests.post(token_url, headers=headers, json=body)
api_token = response.text
print(api_token)

